import { useEffect } from 'react';
import { Button, Form, Input, Select, Space } from 'antd';
import type { ArticleFormValues, ApiErrorResponse } from '../../types/articles';
import { CHANNEL_OPTIONS } from '../../constants/channels';
import { validateArticleInput } from '../../utils/articles/validation';
export interface ArticleFormProps {
  initialValues: Partial<ArticleFormValues>;
  isSubmitting: boolean;
  fieldErrors?: ApiErrorResponse['fieldErrors'];
  onSubmit(values: ArticleFormValues): Promise<void>;
  onCancel(): void;
}
export default function ArticleForm({
  initialValues,
  isSubmitting,
  fieldErrors,
  onSubmit,
  onCancel,
}: ArticleFormProps) {
  // 创建表单实例
  const [form] = Form.useForm<ArticleFormValues>();
  // 处理后端返回的字段错误：如果后端返回了字段校验错误，就把这些错误显示在对应的表单字段下方
  useEffect(() => {
    if (fieldErrors)
      form.setFields(
        (['title', 'channelId', 'content'] as const) // 定义需要检查的字段
          .filter((name) => fieldErrors[name]) // 筛选出存在错误的字段
          .map((name) => ({ name, errors: fieldErrors[name] })), // 转换成 Ant Design 要求的错误结构
      );
  }, [form, fieldErrors]);
  // 定义字段校验规则
  const rule = (field: keyof ArticleFormValues) => ({
    validator: async (_rule: unknown, value: unknown) => {
      const result = validateArticleInput({ [field]: value }, 'update');
      if (!result.ok)
        throw new Error(result.fieldErrors[field]?.[0] ?? result.formError ?? '请检查输入');
    },
  });

  /* 渲染表单 */
  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={initialValues}
      disabled={isSubmitting}
      // 表单校验通过后，执行完整数据校验并调用父组件的提交函数
      onFinish={async (values) => {
        const result = validateArticleInput(values, 'create');
        if (result.ok) await onSubmit(result.values);
      }}
      requiredMark={false}
    >
      {/* 标题：填写并校验文章标题 */}
      <Form.Item label="标题" name="title" rules={[rule('title')]}>
        <Input placeholder="为文章起一个清晰的标题" />
      </Form.Item>

      {/* 频道：从下拉列表选择文章所属频道 */}
      <Form.Item label="所属频道" name="channelId" rules={[rule('channelId')]}>
        <Select virtual={false} options={CHANNEL_OPTIONS} placeholder="选择所属频道" />
      </Form.Item>

      {/* 正文：使用多行文本框编写文章内容 */}
      <Form.Item label="正文" name="content" rules={[rule('content')]}>
        <Input.TextArea rows={12} placeholder="在这里写下正文，支持换行…" />
      </Form.Item>

      {/* 表单操作：提交时校验表单，取消时调用页面传入的回调 */}
      <Space>
        <Button
          type="primary"
          htmlType="submit"
          aria-label="提交"
          loading={isSubmitting}
          disabled={isSubmitting}
        >
          提交
        </Button>
        <Button aria-label="取消" onClick={onCancel}>
          取消
        </Button>
      </Space>
    </Form>
  );
}
