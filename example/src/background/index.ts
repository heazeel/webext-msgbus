import msgbus from 'webext-msgbus/background';

const { sendMessage, onMessage } = msgbus;

// onMessage('POPUP_TO_INJECT', (message) => {
//   console.log('inject: POPUP_TO_INJECT', message);
// });
