# electron-typed-bridge

End-to-end typesafe Electron IPC (Inter-Process Communication).

## Overview

Electron consists of [two types of processes](https://www.electronjs.org/docs/latest/tutorial/process-model) (**main** - Node.js environment and **renderer** - responsible for rendering web content) and relies on [IPC channels](https://www.electronjs.org/docs/latest/tutorial/ipc) to communicate between main and renderer processes. Nevertheless, setting IPC to run correctly and safely is tedious and challenging, especially for large applications.

`electron-typed-bridge` allows you to easily build & consume typesafe IPC channels with Typescript.

- 🧙‍♂️ Full static typesafety & autocompletion with Typescript.
- ✅ Well-tested and production ready.
  - Used in production by apps with hundreds of thousands of users: [WebCatalog](https://webcatalog.io/), [Singlebox](https://singlebox.app/), [Switchbar](https://switchbar.com/), [Translatium](https://translatium.app/).
- 🥃 Subscription support with [RxJS](https://rxjs.dev/).

## Credits

`electron-typed-bridge` is based on:

- [linonetwo/electron-ipc-cat](https://github.com/linonetwo/electron-ipc-cat)
- [frankwallis/electron-ipc-proxy](https://github.com/frankwallis/electron-ipc-proxy/pull/2)
