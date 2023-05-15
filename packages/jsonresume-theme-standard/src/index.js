import { renderToString } from 'react-dom/server';
import Resume from './ui/Resume';

export const render = (resume) => {
  return renderToString(<Resume resume={resume} />);
};
