import { useParams } from 'react-router-dom';

export function ProjectDetailPage() {
  const { id } = useParams();
  return (
    <div>
      <h1>Project detail</h1>
      <p>(stepper, character/chapter cards go here, project id: {id})</p>
    </div>
  );
}
