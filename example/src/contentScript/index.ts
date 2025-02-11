import { onMessage, sendMessage } from 'webext-msgbus/contentScript';

console.log('content-script: init');

// const res = await sendMessage(
//   'CONTENT_TO_BG',
//   {
//     first_name: 'John',
//     last_name: 'Doe',
//   },
//   'background',
// );
// console.log('receive res from background', res);

onMessage('POPUP_TO_CONTENT', async (message) => {
  console.log('content-script: receive message from popup:', message);

  return { name: 'content' };
});

onMessage('BG_TO_CONTENT', (message) => {
  console.log('content-script: receive message from background:', message);

  return { name: 'content' };
});

onMessage('DEVTOOLS_TO_CONTENT', (message) => {
  console.log('content-script: receive message from devtools:', message);

  return { name: 'content' };
});
