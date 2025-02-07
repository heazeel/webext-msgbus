import './index.css';

import { sendMessage } from 'webext-msgbus/popup';

export const Popup = () => {
  const onClick = async () => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (tabs[0].id) {
        const res = await sendMessage(
          'POPUP_TO_INJECT',
          {
            first_name: 'John',
            last_name: 'Doe',
          },
          `inject-script@${tabs[0].id}`,
        );
      }
    });
  };

  return (
    <div className="popup-wrapper">
      <button onClick={onClick}>init</button>
    </div>
  );
};
