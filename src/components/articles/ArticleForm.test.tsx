import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { AppProviders } from '../../app/AppProviders';
import { createAppQueryClient } from '../../lib/queryClient';
import ArticleForm from './ArticleForm';
it('validates required fields and submits trimmed titles with unchanged body', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  render(
    <AppProviders queryClient={createAppQueryClient()}>
      <ArticleForm
        initialValues={{}}
        isSubmitting={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />
    </AppProviders>,
  );
  await user.click(screen.getByRole('button', { name: '提交' }));
  expect(onSubmit).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByText('请选择有效频道')).toBeVisible());
  await user.type(screen.getByRole('textbox', { name: '标题' }), '  标题  ');
  await user.click(screen.getByRole('combobox', { name: '所属频道' }));
  await user.click(await screen.findByRole('option', { name: '技术' }));
  await user.type(screen.getByRole('textbox', { name: '正文' }), '第一行{enter}第二行');
  await user.click(screen.getByRole('button', { name: '提交' }));
  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith({
      title: '标题',
      channelId: 1,
      content: '第一行\n第二行',
    }),
  );
});
it('keeps a mounted draft when initial values change and disables pending submit', async () => {
  const onSubmit = vi.fn().mockResolvedValue(undefined),
    user = userEvent.setup();
  const view = render(
    <ArticleForm
      initialValues={{ title: '初始' }}
      isSubmitting={false}
      onSubmit={onSubmit}
      onCancel={() => {}}
    />,
  );
  await user.clear(screen.getByRole('textbox', { name: '标题' }));
  await user.type(screen.getByRole('textbox', { name: '标题' }), '我的草稿');
  view.rerender(
    <ArticleForm
      initialValues={{ title: '刷新' }}
      isSubmitting
      onSubmit={onSubmit}
      onCancel={() => {}}
    />,
  );
  expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('我的草稿');
  expect(screen.getByRole('button', { name: '提交' })).toBeDisabled();
});
it('maps server field errors without resetting entered content', async () => {
  render(
    <ArticleForm
      initialValues={{ title: '保留标题', channelId: 1, content: '保留正文' }}
      isSubmitting={false}
      fieldErrors={{ title: ['服务器标题错误'] }}
      onSubmit={async () => {}}
      onCancel={() => {}}
    />,
  );
  await waitFor(() => expect(screen.getByText('服务器标题错误')).toBeVisible());
  expect(screen.getByRole('textbox', { name: '标题' })).toHaveValue('保留标题');
});
