import { createRoot } from 'react-dom/client';

import { Popup } from './popup';

const root = createRoot(document.querySelector('#root')!);

root.render(<Popup />);
