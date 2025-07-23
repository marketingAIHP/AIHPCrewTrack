export interface Admin {
  id: number;
  firstName: string;
  lastName: string;
  companyName: string;
  email: string;
}

export interface Employee {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  siteId?: number;
}

export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('authToken', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
};

export const getUser = (): Admin | Employee | null => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const setUser = (user: Admin | Employee): void => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const removeUser = (): void => {
  localStorage.removeItem('user');
};

export const getUserType = (): 'admin' | 'employee' | null => {
  return localStorage.getItem('userType') as 'admin' | 'employee' | null;
};

export const setUserType = (type: 'admin' | 'employee'): void => {
  localStorage.setItem('userType', type);
};

export const removeUserType = (): void => {
  localStorage.removeItem('userType');
};

export const logout = (): void => {
  removeAuthToken();
  removeUser();
  removeUserType();
};

export const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};
