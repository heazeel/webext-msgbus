import msgbus from 'webext-msgbus/background';

const { sendMessage, onMessage } = msgbus;

onMessage('SIDE_PANEL_TO_BACKGROUND', async (message) => {
  console.log('background: get msg from sidePanel', message);
  return 'background response';
});

onMessage('OPTIONS_TO_BACKGROUND', async (message) => {
  console.log('background: get msg from options', message);
  return 'background response';
});
