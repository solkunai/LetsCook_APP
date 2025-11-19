import { getConnection } from './connection';

// Simple connection using environment variable
export const getSimpleConnection = () => {
  return getConnection('confirmed');
};