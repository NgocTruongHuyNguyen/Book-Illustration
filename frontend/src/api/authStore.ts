const STORAGE_KEY = 'bookStudio.userEmail';
 
export function getCurrentUserEmail(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
 
export function setCurrentUserEmail(email: string): void {
  localStorage.setItem(STORAGE_KEY, email);
}
 
export function clearCurrentUserEmail(): void {
  localStorage.removeItem(STORAGE_KEY);
}