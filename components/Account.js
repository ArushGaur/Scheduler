'use client';
import InstallApp from './InstallApp';

export function Avatar({ user, size = 36 }) {
  const initial = (user.name || user.email || '?').trim().charAt(0).toUpperCase();
  return user.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="avatar" src={user.image} alt="" width={size} height={size} referrerPolicy="no-referrer" />
  ) : (
    <span className="avatar fallback" style={{ width: size, height: size }} aria-hidden="true">
      {initial}
    </span>
  );
}

export default function Account({ user, elective, isAdmin, onManage, onChangeElective, onSignOut }) {
  return (
    <div className="account">
      <div className="account-who">
        <Avatar user={user} size={52} />
        <div>
          {user.name && <strong>{user.name}</strong>}
          <p>{user.email}</p>
        </div>
      </div>
      <div className="account-elective">
        <div>
          <span className="account-label">HSS elective</span>
          <strong>{elective ? `${elective.name} (${elective.code})` : 'Not chosen'}</strong>
        </div>
        <button className="btn secondary" onClick={onChangeElective}>{elective ? 'Change' : 'Choose'}</button>
      </div>
      {isAdmin && (
        <div className="account-elective">
          <div>
            <span className="account-label">Owner</span>
            <strong>Schedule changes</strong>
          </div>
          <button className="btn secondary" onClick={onManage}>Manage</button>
        </div>
      )}
      <InstallApp />
      <p className="account-note">Your classes, routines and attendance are saved to your account, so you will see them on any device you sign in from.</p>
      <button className="btn secondary account-out" onClick={onSignOut}>
        Sign out
      </button>
    </div>
  );
}
