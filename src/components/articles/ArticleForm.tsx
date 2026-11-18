import { useEffect } from 'react';
import { Button, Form, Input, Select, Space } from 'antd';
import type { ArticleFormValues, ApiErrorResponse } from '../../types/articles';
import { CHANNEL_OPTIONS } from '../../constants/channels';
import { validateArticleInput } from '../../utils/articles/validation';
export interface ArticleFormProps { initialValues: Partial<ArticleFormValues>; isSubmitting: boolean; fieldErrors?: ApiErrorResponse['fieldErrors']; onSubmit(values: ArticleFormValues): Promise<void>; onCancel(): void }
export default function ArticleForm({initialValues,isSubmitting,fieldErrors,onSubmit,onCancel}: ArticleFormProps) {
 const [form]=Form.useForm<ArticleFormValues>();
 useEffect(()=>{if(fieldErrors) form.setFields((['title','channelId','content'] as const).filter(name=>fieldErrors[name]).map(name=>({name,errors:fieldErrors[name]})));},[form,fieldErrors]);
 const rule=(field:keyof ArticleFormValues)=>({validator:async(_rule:unknown,value:unknown)=>{const result=validateArticleInput({[field]:value},'update');if(!result.ok) throw new Error(result.fieldErrors[field]?.[0]??result.formError??'请检查输入');}});
 return <Form form={form} layout="vertical" initialValues={initialValues} disabled={isSubmitting} onFinish={async values=>{const result=validateArticleInput(values,'create');if(result.ok)await onSubmit(result.values);}} requiredMark={false}>
  <Form.Item label="标题" name="title" rules={[rule('title')]}><Input placeholder="为文章起一个清晰的标题" /></Form.Item>
  <Form.Item label="所属频道" name="channelId" rules={[rule('channelId')]}><Select virtual={false} options={CHANNEL_OPTIONS} placeholder="选择所属频道" /></Form.Item>
  <Form.Item label="正文" name="content" rules={[rule('content')]}><Input.TextArea rows={12} placeholder="在这里写下正文，支持换行…" /></Form.Item>
  <Space><Button type="primary" htmlType="submit" aria-label="提交" loading={isSubmitting} disabled={isSubmitting}>提交</Button><Button aria-label="取消" onClick={onCancel}>取消</Button></Space>
 </Form>;
}
