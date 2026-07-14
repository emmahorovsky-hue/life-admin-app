import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { User } from '@life-admin/shared';
import { toast } from 'sonner';
import { AvatarTile } from './AvatarTile';
import { useAuth } from '@/contexts/AuthContext';
import { uploadAvatar, deleteAvatar } from '@/lib/api';

vi.mock('@/contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api')>();
  return { ...actual, uploadAvatar: vi.fn(), deleteAvatar: vi.fn() };
});

const mockedUseAuth = vi.mocked(useAuth);
const mockedUpload = vi.mocked(uploadAvatar);
const mockedDelete = vi.mocked(deleteAvatar);
const updateUser = vi.fn();

function setUser(partial: Partial<User> = {}) {
  mockedUseAuth.mockReturnValue({
    user: { id: 'u1', email: 'me@example.com', name: 'Marlowe', surname: 'Vance', avatarUpdatedAt: null, ...partial } as User,
    loading: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    updateUser,
  } as unknown as ReturnType<typeof useAuth>);
}

function pngFile(sizeBytes = 1024) {
  return new File([new Uint8Array(sizeBytes)], 'avatar.png', { type: 'image/png' });
}

describe('AvatarTile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUser();
  });

  it('shows initials when no avatar is set', () => {
    render(<AvatarTile />);
    expect(screen.getByText('MV')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('renders the avatar image (cache-busted) when avatarUpdatedAt is set', () => {
    setUser({ avatarUpdatedAt: '2026-07-14T00:00:00.000Z' });
    render(<AvatarTile />);
    const img = screen.getByRole('img', { name: 'Your profile photo' });
    expect(img).toHaveAttribute('src', expect.stringContaining('/account/avatar?v='));
  });

  it('uploads a valid PNG and refreshes the user', async () => {
    const user = userEvent.setup();
    mockedUpload.mockResolvedValue({
      data: { user: { avatarUpdatedAt: '2026-07-14T00:00:00.000Z' } },
    } as Awaited<ReturnType<typeof uploadAvatar>>);
    const { container } = render(<AvatarTile />);

    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, pngFile());

    await waitFor(() => expect(mockedUpload).toHaveBeenCalled());
    expect(updateUser).toHaveBeenCalledWith(
      expect.objectContaining({ avatarUpdatedAt: '2026-07-14T00:00:00.000Z' })
    );
    expect(toast.success).toHaveBeenCalledWith('Photo updated.');
  });

  it('rejects an oversize file client-side without calling the API', async () => {
    const user = userEvent.setup();
    const { container } = render(<AvatarTile />);

    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    await user.upload(input, pngFile(3 * 1024 * 1024));

    expect(mockedUpload).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('That image is too large. JPG or PNG, up to 2 MB.');
  });

  it('rejects a non-image type client-side', async () => {
    // Disable the input's accept filter so the file reaches our own guard
    // (the guard also covers drag-drop and other non-picker paths).
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<AvatarTile />);

    const input = container.querySelector('input[type=file]') as HTMLInputElement;
    const pdf = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    await user.upload(input, pdf);

    expect(mockedUpload).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith('Unsupported file type. Choose a JPG or PNG.');
  });

  it('removes the photo when allowRemove and an avatar exists', async () => {
    const user = userEvent.setup();
    setUser({ avatarUpdatedAt: '2026-07-14T00:00:00.000Z' });
    mockedDelete.mockResolvedValue({
      data: { user: { avatarUpdatedAt: null } },
    } as Awaited<ReturnType<typeof deleteAvatar>>);
    render(<AvatarTile allowRemove />);

    await user.click(screen.getByRole('button', { name: 'Remove photo' }));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalled());
    expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ avatarUpdatedAt: null }));
    expect(toast.success).toHaveBeenCalledWith('Photo removed.');
  });

  it('hides the remove control when there is no avatar', () => {
    render(<AvatarTile allowRemove />);
    expect(screen.queryByRole('button', { name: 'Remove photo' })).not.toBeInTheDocument();
  });
});
