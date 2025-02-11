import { onMessage, sendMessage } from 'webext-msgbus/injectScript';

onMessage('POPUP_TO_INJECT', (message) => {
  console.log('inject: received msg from popup', message);
});

onMessage('CONTENT_TO_INJECT', (message) => {
  console.log('inject: received msg from content', message);
});
