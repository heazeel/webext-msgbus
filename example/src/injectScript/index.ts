import { onMessage, sendMessage } from 'webext-msgbus/injectScript';

onMessage('POPUP_TO_INJECT', (message) => {
  console.log('inject: received msg from popup', message);
  return 'inject: received msg from popup';
});

onMessage('CONTENT_TO_INJECT', (message) => {
  console.log('inject: received msg from content', message);
  return 'inject: received msg from content';
});
