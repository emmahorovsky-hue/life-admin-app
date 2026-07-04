type LogoutFn = () => Promise<void>;

let _logout: LogoutFn | null = null;

export const registerLogout = (fn: LogoutFn) => {
  _logout = fn;
};

export const callLogout = () => _logout?.();
