import type { FC } from 'react';

interface LoadingIndicatorProps {
  label?: string;
}

const LoadingIndicator: FC<LoadingIndicatorProps> = ({ label = 'Waiting for the model…' }) => {
  return (
    <div className="loading-indicator">
      <span className="loading-spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
};

export default LoadingIndicator;
