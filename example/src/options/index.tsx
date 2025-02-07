import { createRoot } from 'react-dom/client';

import { Options } from './options';

const root = createRoot(document.querySelector('#root')!);

root.render(<Options />);
