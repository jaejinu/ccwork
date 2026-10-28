import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NoteEditor } from './NoteEditor';
import { NotesProvider } from '../context/NotesContext';
import * as api from '../api/notes';
import { Note } from '../types/note';

vi.mock('../api/notes');

const existing: Note = {
  id: '1',
  title: '기존 제목',
  content: '기존 내용',
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

type Props = Parameters<typeof NoteEditor>[0];

const editorUi = (props: Props) => (
  <NotesProvider>
    <NoteEditor {...props} />
  </NotesProvider>
);

// NoteEditor 는 선택이 바뀔 때만 폼을 동기화하므로,
// 실제 앱처럼 목록 로드가 끝난 뒤에 선택 상태를 넘긴다
async function renderEditor(props: Props) {
  const view = render(editorUi({ ...props, selectedNoteId: null, isCreating: false }));
  // fetchNotes 응답으로 인한 상태 업데이트를 act 안에서 모두 반영
  await act(async () => {});
  view.rerender(editorUi(props));
  return view;
}

describe('NoteEditor', () => {
  const onDone = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.fetchNotes).mockResolvedValue([existing]);
  });

  it('선택된 노트가 없으면 안내 문구를 보여준다', async () => {
    await renderEditor({ selectedNoteId: null, isCreating: false, onDone });
    expect(screen.getByText('노트를 선택하거나 새 노트를 만드세요')).toBeInTheDocument();
  });

  it('노트를 선택하면 제목과 내용을 폼에 채운다', async () => {
    await renderEditor({ selectedNoteId: '1', isCreating: false, onDone });
    expect(await screen.findByDisplayValue('기존 제목')).toBeInTheDocument();
    expect(screen.getByDisplayValue('기존 내용')).toBeInTheDocument();
    expect(screen.getByText('노트 편집')).toBeInTheDocument();
  });

  it('제목이 비어 있으면 저장하지 않고 alert 를 띄운다', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    await renderEditor({ selectedNoteId: null, isCreating: true, onDone });
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(alertSpy).toHaveBeenCalledWith('제목을 입력해주세요');
    expect(api.createNote).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it('새 노트 모드에서 저장하면 createNote 를 호출하고 onDone 을 부른다', async () => {
    vi.mocked(api.createNote).mockResolvedValue({ ...existing, id: '2', title: '새 제목' });
    await renderEditor({ selectedNoteId: null, isCreating: true, onDone });
    await userEvent.type(screen.getByPlaceholderText('제목'), '새 제목');
    await userEvent.type(screen.getByPlaceholderText('내용을 입력하세요...'), '새 내용');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(api.createNote).toHaveBeenCalledWith({ title: '새 제목', content: '새 내용' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('편집 모드에서 저장하면 updateNote 에 변경된 값을 보낸다', async () => {
    vi.mocked(api.updateNote).mockResolvedValue({ ...existing, title: '바뀐 제목' });
    await renderEditor({ selectedNoteId: '1', isCreating: false, onDone });
    const title = await screen.findByDisplayValue('기존 제목');
    await userEvent.clear(title);
    await userEvent.type(title, '바뀐 제목');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(api.updateNote).toHaveBeenCalledWith('1', { title: '바뀐 제목', content: '기존 내용' });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('저장에 실패하면 alert 를 띄우고 onDone 을 부르지 않는다', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(api.createNote).mockRejectedValue(new Error('Failed to create note'));
    await renderEditor({ selectedNoteId: null, isCreating: true, onDone });
    await userEvent.type(screen.getByPlaceholderText('제목'), '새 제목');
    await userEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(alertSpy).toHaveBeenCalledWith('저장에 실패했습니다');
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '저장' })).toBeEnabled();
  });
});
