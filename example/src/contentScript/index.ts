import { onMessage } from 'webext-msgbus/contentScript';

onMessage('POPUP_TO_CONTENT', async (message) => {
  console.log('content-script: receive message from popup:', message);
  return 'content response';
});

onMessage('BG_TO_CONTENT', (message) => {
  console.log('content-script: receive message from background:', message);
  return 'content response';
});

onMessage('DEVTOOLS_TO_CONTENT', (message) => {
  console.log('content-script: receive message from devtools:', message);
  return 'content response';
});
