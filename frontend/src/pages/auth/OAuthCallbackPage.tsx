import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../../components/ui';
import toast from 'react-hot-toast';

/**
 * Landing page for the Google OAuth redirect.
 *
 * The API returns the token pair in the URL fragment (`#accessToken=…`), which
 * browsers never send to a server. The fragment is read once, stripped from
 * the address bar, and exchanged for the signed-in user.
 */
const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { completeOAuthLogin } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const failure = params.get('error');
    const accessToken = params.get('accessToken');
    const refreshToken = params.get('refreshToken');
    const redirectTo = params.get('redirectTo');

    // Keep the tokens out of the address bar and browser history.
    window.history.replaceState(null, '', window.location.pathname);

    if (failure || !accessToken || !refreshToken) {
      setError(failure || 'Google did not return a valid session.');
      return;
    }

    completeOAuthLogin(accessToken, refreshToken)
      .then(() => {
        toast.success('Signed in with Google');
        navigate(redirectTo || '/dashboard', { replace: true });
      })
      .catch(() => setError('Could not complete sign-in. Please try again.'));
  }, [completeOAuthLogin, navigate]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center">
          <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-7 h-7 text-red-500" />
          </div>
          <h1 className="text-lg font-semibold text-gray-900">Google sign-in failed</h1>
          <p className="text-sm text-gray-500 mt-2 break-words">{error}</p>
          <Link
            to="/login"
            className="inline-block mt-6 text-sm font-medium text-primary-600 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-50 to-blue-100">
      <Spinner />
      <p className="text-sm text-gray-500 mt-3">Finishing sign-in…</p>
    </div>
  );
};

export default OAuthCallbackPage;
