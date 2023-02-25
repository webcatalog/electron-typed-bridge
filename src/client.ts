import { Event, IpcRenderer, ipcRenderer } from 'electron';
import { memoize } from 'lodash';
import {
  Observable,
  Observer,
  Subscribable,
  TeardownLogic,
  isObservable,
} from 'rxjs';
import { deserializeError } from 'serialize-error';

import {
  ProxyDescriptor,
  ProxyPropertyType,
  Request,
  RequestType,
  Response,
  ResponseType,
} from './common';
import { IpcProxyError, getSubscriptionKey } from './utils';

export type ObservableConstructor = new (
  subscribe: (obs: Observer<any>) => TeardownLogic,
) => Subscribable<any>;

async function makeRequest(
  request: Request,
  channel: string,
  transport: IpcRenderer,
): Promise<unknown> {
  const correlationId = String(Math.random());
  transport.send(channel, request, correlationId);

  return new Promise((resolve, reject) => {
    transport.once(correlationId, (event: Event, response: Response) => {
      switch (response.type) {
        case ResponseType.Result:
          return resolve(response.result);
        case ResponseType.Error:
          return reject(deserializeError(JSON.parse(response.error)));
        default:
          return reject(
            new IpcProxyError(`Unhandled response type [${response.type}]`),
          );
      }
    });
  });
}

function makeObservable(
  request: Request,
  channel: string,
  ObservableCtor: ObservableConstructor,
  transport: IpcRenderer,
): Subscribable<any> {
  return new ObservableCtor((observer) => {
    const subscriptionId = String(Math.random());
    const subscriptionRequest = { ...request, subscriptionId };

    transport.on(subscriptionId, (event: Event, response: Response) => {
      switch (response.type) {
        case ResponseType.Next:
          return observer.next(response.value);
        case ResponseType.Error:
          return observer.error(deserializeError(JSON.parse(response.error)));
        case ResponseType.Complete:
          return observer.complete();
        default:
          return observer.error(
            new IpcProxyError(`Unhandled response type [${response.type}]`),
          );
      }
    });

    makeRequest(subscriptionRequest, channel, transport).catch(
      (error: Error) => {
        // eslint-disable-next-line no-console
        console.error('Error subscribing to remote observable', error);
        observer.error(error);
      },
    );

    return () => {
      transport.removeAllListeners(subscriptionId);
      makeRequest(
        { type: RequestType.Unsubscribe, subscriptionId },
        channel,
        transport,
      ).catch((error) => {
        // eslint-disable-next-line no-console
        console.error('Error unsubscribing from remote observale', error);
        observer.error(error);
      });
    };
  });
}

function getProperty(
  propertyType: ProxyPropertyType,
  propertyKey: string,
  channel: string,
  ObservableCtor: ObservableConstructor,
  transport: IpcRenderer,
):
  | Promise<any>
  | Subscribable<any>
  | ((...arguments_: any[]) => Promise<any>)
  | ((...arguments_: any[]) => Subscribable<any>) {
  switch (propertyType) {
    case ProxyPropertyType.Value:
      return makeRequest(
        { type: RequestType.Get, propKey: propertyKey },
        channel,
        transport,
      );
    case ProxyPropertyType.Value$:
      return makeObservable(
        { type: RequestType.Subscribe, propKey: propertyKey },
        channel,
        ObservableCtor,
        transport,
      );
    case ProxyPropertyType.Function:
      return async (...arguments_: unknown[]) =>
        makeRequest(
          { type: RequestType.Apply, propKey: propertyKey, args: arguments_ },
          channel,
          transport,
        );
    default:
      throw new IpcProxyError(
        // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
        `Unrecognised ProxyPropertyType [${propertyType}]`,
      );
  }
}

export function createProxy<T>(
  descriptor: ProxyDescriptor,
  ObservableCtor: ObservableConstructor = Observable,
  transport: IpcRenderer = ipcRenderer,
): T {
  const result = {};

  Object.keys(descriptor.properties).forEach((propertyKey) => {
    const propertyType = descriptor.properties[propertyKey];

    // Provide feedback if the Observable constructor has not been passed in
    if (
      propertyType === ProxyPropertyType.Value$ &&
      typeof ObservableCtor !== 'function'
    ) {
      throw new Error(
        'You must provide an implementation of the Observable constructor if you want to proxy Observables. Please see the docs at https://github.com/frankwallis/electron-ipc-proxy.',
      );
    }

    // fix https://github.com/electron/electron/issues/28176
    if (propertyType === ProxyPropertyType.Value$) {
      Object.defineProperty(result, getSubscriptionKey(propertyKey), {
        enumerable: true,
        get: memoize(() => (next: (value?: any) => void) => {
          const originalObservable = getProperty(
            propertyType,
            propertyKey,
            descriptor.channel,
            ObservableCtor,
            transport,
          );
          if (isObservable(originalObservable)) {
            originalObservable.subscribe((value: any) => next(value));
          }
        }),
      });
    } else {
      Object.defineProperty(result, propertyKey, {
        enumerable: true,
        get: memoize(() =>
          getProperty(
            propertyType,
            propertyKey,
            descriptor.channel,
            ObservableCtor,
            transport,
          ),
        ),
      });
    }
  });

  return result as T;
}

export { ProxyDescriptor, ProxyPropertyType } from './common';
