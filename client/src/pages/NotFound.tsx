import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-nexus-500 text-6xl font-bold mb-4">404</p>
        <h1 className="text-gray-200 text-xl font-semibold mb-2">
          Signal Lost
        </h1>
        <p className="text-gray-500 text-sm mb-6">
          This sector of the command grid doesn't exist.
        </p>
        <Link to="/" className="btn-primary inline-block">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
