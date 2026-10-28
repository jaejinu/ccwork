import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NotesProvider, useNotes } from './NotesContext';
import * as api from '../api/notes';
import { Note } from '../types/note';

vi.mock('../api/notes');

const makeNote = (id: string, title: string): Note => ({
  id,
  title,
  content: '',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
});

// context 값을 화면에 노출하는 테스트용 소비자
function Probe() {
  const { notes, loading, error, addNote, editNote, removeNote } = useNotes();
  if (loading) return <p>로딩 중</p>;
  if (error) return <p>오류: {error}</p>;
  return (
    <div>
      <ul>
        {notes.map((n) => (
          <li key={n.id}>{n.title}</li>
        ))}
      </ul>
      <button onClick={() => addNote('새 노트', '내용')}>추가</button>
      <button onClick={() => editNote('1', { title: '수정됨' })}>수정</button>
      <button onClick={() => removeNote('1')}>삭제</button>
    </div>
  );
}

const renderWithProvider = () =>
  render(
    <NotesProvider>
      <Probe />
    </NotesProvider>,
  );

describe('NotesContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchNotes).mockResolvedValue([
      makeNote('1', '첫 노트'),
      makeNote('2', '둘째 노트'),
    ]);
  });

  it('마운트 시 노트 목록을 불러온다', async () => {
    renderWithProvider();
    expect(screen.getByText('로딩 중')).toBeInTheDocument();
    expect(await screen.findByText('첫 노트')).toBeInTheDocument();
    expect(screen.getByText('둘째 노트')).toBeInTheDocument();
  });

  it('불러오기에 실패하면 error 를 노출한다', async () => {
    vi.mocked(api.fetchNotes).mockRejectedValue(new Error('Failed to fetch notes'));
    renderWithProvider();
    expect(await screen.findByText('오류: Failed to fetch notes')).toBeInTheDocument();
  });

  it('addNote 는 API 응답으로 받은 노트를 목록 끝에 추가한다', async () => {
    vi.mocked(api.createNote).mockResolvedValue(makeNote('3', '새 노트'));
    renderWithProvider();
    await userEvent.click(await screen.findByText('추가'));

    expect(api.createNote).toHaveBeenCalledWith({ title: '새 노트', content: '내용' });
    expect(await screen.findByText('새 노트')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
  });

  it('editNote 는 같은 id 의 노트를 응답값으로 교체한다', async () => {
    vi.mocked(api.updateNote).mockResolvedValue(makeNote('1', '수정됨'));
    renderWithProvider();
    await userEvent.click(await screen.findByText('수정'));

    expect(api.updateNote).toHaveBeenCalledWith('1', { title: '수정됨' });
    expect(await screen.findByText('수정됨')).toBeInTheDocument();
    expect(screen.queryByText('첫 노트')).not.toBeInTheDocument();
  });

  it('removeNote 는 노트를 목록에서 제거한다', async () => {
    vi.mocked(api.deleteNote).mockResolvedValue();
    renderWithProvider();
    await userEvent.click(await screen.findByText('삭제'));

    expect(api.deleteNote).toHaveBeenCalledWith('1');
    expect(screen.queryByText('첫 노트')).not.toBeInTheDocument();
    expect(screen.getByText('둘째 노트')).toBeInTheDocument();
  });

  it('Provider 밖에서 useNotes 를 호출하면 에러를 던진다', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useNotes must be used within NotesProvider');
  });
});
