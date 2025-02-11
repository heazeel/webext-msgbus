import msgbus from 'webext-msgbus/background';

const { sendMessage, onMessage } = msgbus;

// onMessage('POPUP_TO_INJECT', (message) => {
//   console.log('inject: POPUP_TO_INJECT', message);
// });

onMessage('SIDE_PANEL_TO_BACKGROUND', async (message) => {
  console.log('background: get msg from sidePanel', message);
  return 'background response';
});

// chrome.sidePanel
//   .setPanelBehavior({ openPanelOnActionClick: true })
//   .catch((error) => console.error(error));
