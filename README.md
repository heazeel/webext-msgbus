# webext-msgbus

## Introduction

`webext-msgbus` is a tiny library that provides a simple and consistent API for sending and receiving messages between different parts of web extension, such as `background`, `content-script`, `devtools`, `popup`, `options`, and `inject-script` contexts.

## Usage

### background
```js
import { sendMessage, onMessage } from 'webext-msgbus/background';

sendMessage('MSG_ID', 'Your Data', `content-script@${tabs[0].id}`)

onMessage('MSG_ID', (msg) => {
  const { data } = msg;
  console.log(data);
})
```
