import { createRoot } from 'react-dom/client';
import { sendMessage } from 'webext-msgbus/devtools';

const root = createRoot(document.querySelector('#root')!);

const onClick = async () => {
  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    if (tabs[0].id) {
      const res = await sendMessage(
        'DEVTOOLS_TO_CONTENT',
        'devtools_to_content',
        `content-script@${tabs[0].id}`,
      );
    }
  });
};

root.render(<button onClick={onClick}>test</button>);
