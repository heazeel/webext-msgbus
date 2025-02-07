import { onMessage } from 'webext-msgbus/injectScript';

onMessage('POPUP_TO_INJECT', (message) => {
  console.log('inject: POPUP_TO_INJECT', message);
});
