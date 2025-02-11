import { useState } from 'react';
import { sendMessage } from 'webext-msgbus/sidePanel';

export const Panel = () => {
  const [msg, setMsg] = useState('');

  const onClick = async () => {
    const data = await sendMessage<string>('SIDE_PANEL_TO_BACKGROUND', 'data', 'background');
    setMsg('sidePanel: get msg from background' + data);
  };

  return (
    <div className="popup-wrapper">
      <button onClick={onClick}>sidePanel</button>
      {msg}
    </div>
  );
};
