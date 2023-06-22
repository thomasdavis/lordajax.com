import { Button } from 'ui';
import { Resume } from 'jsonresume-theme-standard';
import resume from './api/samples/resume';
export default function Talk() {
  return (
    <div>
      <Resume resume={resume} />
    </div>
  );
}
