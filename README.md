# webext-msgbus

## Introduction

`webext-msgbus` is a tiny library that provides a simple and consistent API for sending and receiving messages between different parts of web extension, such as `background`, `content-script`, `devtools`, `popup`, `options`, `sidepanel` , and `inject-script` contexts.

## Api

### **sendMessage()**
`sendMessage(messageId: string, data: any, destination: string)`

Sends a message to some other part of your extension.

* If there is no listener on the other side an error will be thrown where `sendMessage` was called.
* Listener on the other may want to reply. Get the reply by `awaiting` the returned `Promise`
* An error thrown in listener callback (in the destination context) will behave as usual, that is, bubble up, but the same error will also be thrown where `sendMessage` was called
* If the listener receives the message but the destination disconnects (tab closure for exmaple) before responding, `sendMessage` will throw an error in the sender context.

#### messageId

**Required | string**

Any `string` that both sides of your extension agree on. Could be `get-flag-count` or `getFlagCount` or `GET_FLAG_COUNT`, as long as it's same on receiver's onMessage listener.

#### data

**Required | any**

Any serializable value you want to pass to other side, latter can access this value by refering to data property of first argument to `onMessage` callback function.

#### destination

**Required | string**

The actual identifier of other endpoint.

* background
* content-script@{tabId}
* inject-script@{tabId}
* devtools@{tabId}
* popup
* options
* sidepanel

`content-script`, `inject-script` and `devtools` destinations can be suffixed with `@{tabId}` to target specific tab. Example: `devtools@123`, points to devtools panel inspecting tab with id 123.

### **onMessage()**

`onMessage(messageId: string, callback: function)`

Register one and only one listener, per messageId per context. That will be called upon `sendMessage` from other side.

Optionally, send a response to sender by returning any value or if async a `Promise`.

#### messageId

**Required | string**

Any `string` that both sides of your extension agree on. Could be `get-flag-count` or `getFlagCount` or `GET_FLAG_COUNT`, as long as it's same in sender's sendMessage call.

#### callback

**Required | function**

A callback function `webext-msgbus` should call when a message is received with same `messageId`. The callback function will be called with one argument, a `message` which has `sender`, `data` and `timestamp` as its properties.

Optionally, this callback can return a value or a Promise, resolved value will sent as reply to sender.

## Usage

[example](./example/)

### content-script
```ts
import { sendMessage, onMessage } from 'webext-msgbus/contentScript';

sendMessage('MSG_ID_1', 'Your Data', 'background');

onMessage('MSG_ID_2', (msg) => {
  const { data } = msg;
  console.log(data);
})
```

### background
```ts
import { sendMessage, onMessage } from 'webext-msgbus/background';

sendMessage('MSG_ID_2', 'Your Data', `content-script@${tabs[0].id}`);

onMessage('MSG_ID_1', (msg) => {
  const { data } = msg;
  console.log(data);
})
```
