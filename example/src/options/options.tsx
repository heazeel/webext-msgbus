import { sendMessage } from 'webext-msgbus/options';

export const Options = () => {
  const onClick = async () => {
    const result = await sendMessage<string>('OPTIONS_TO_BACKGROUND', 'popup: hello', 'background');
    console.log('options: received msg from popup', result);
  };

  return (
    <div className="popup-wrapper">
      <button onClick={onClick}>option</button>
    </div>
  );
};
