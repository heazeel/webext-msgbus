import { createRoot } from 'react-dom/client';

import { Panel } from './panel';

const root = createRoot(document.querySelector('#root')!);

root.render(<Panel />);
