/**
 * fix https://github.com/electron/electron/issues/28176
 * We cannot pass Observable across contextBridge, so we have to add a hidden patch to the object on preload script, and use that patch to regenerate Observable on renderer side
 * This file is "unsafe" and will full of type warnings, which is necessary
 */
import { Observable } from 'rxjs';

import {
  IServicesWithOnlyObservables,
  IServicesWithoutObservables,
  ProxyDescriptor,
  ProxyPropertyType,
} from './common';
import { getSubscriptionKey } from './utils';

interface IWindow {
  observables: IServicesWithOnlyObservables<any>;
  service: IServicesWithoutObservables<any>;
}

/**
 * Create `(window as IWindow).observables.xxx` from `(window as IWindow).service.xxx`
 * @param name service name
 * @param service service client proxy created in preload script
 * @param descriptor electron ipc proxy descriptor
 */
export function ipcProxyFixContextIsolation<T extends Record<string, any>>(
  name: keyof IWindow['service'],
  service: T,
  descriptor: ProxyDescriptor,
): void {
  if ((window as unknown as IWindow).observables === undefined) {
    (window as unknown as IWindow).observables = {} as IWindow['observables'];
  }

  Object.keys(descriptor.properties).forEach((key) => {
    // Process all Observables, we pass a `.next` function from preload script, that we can used to reconstruct Observable
    if (
      ProxyPropertyType.Value$ === descriptor.properties[key] &&
      !(key in service) &&
      getSubscriptionKey(key) in service
    ) {
      const subscribedObservable = new Observable((observer) => {
        service[getSubscriptionKey(key)]((value: any) => observer.next(value));
      }) as T[keyof T];
      // store newly created Observable to `(window as IWindow).observables.xxx.yyy`
      if (
        (window as unknown as IWindow).observables[name as string] === undefined
      ) {
        ((window as unknown as IWindow).observables as any)[name] = {
          [key]: subscribedObservable,
        };
      } else {
        ((window as unknown as IWindow).observables as any)[name][key] =
          subscribedObservable;
      }
    }
  });
}

/**
 * Process `(window as IWindow).service`, reconstruct Observables into `(window as IWindow).observables`
 */
export function fixContextIsolation(): void {
  const { descriptors, ...services } = (window as unknown as IWindow).service;

  Object.keys(services).forEach((key) => {
    const serviceName = key as Exclude<keyof IWindow['service'], 'descriptors'>;
    ipcProxyFixContextIsolation(
      serviceName,
      services[serviceName as string],
      descriptors[serviceName as number],
    );
  });
}
