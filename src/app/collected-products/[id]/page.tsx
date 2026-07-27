'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useEditForm } from '@/components/collected-product-edit/hooks/useEditForm';
import { EditPageLayout } from '@/components/collected-product-edit/EditPageLayout';

export default function CollectedProductEditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const {
    state,
    dispatch,
    loadProduct,
    handleSave,
    handleTranslate,
    handlePublish,
    handleConvert,
  } = useEditForm();

  useEffect(() => {
    loadProduct(id);
  }, [id, loadProduct]);

  const onSave = useCallback(async () => {
    await handleSave(id);
  }, [handleSave, id]);

  const onTranslate = useCallback(async () => {
    await handleTranslate(id);
  }, [handleTranslate, id]);

  const onPublish = useCallback(async () => {
    await handlePublish(id);
  }, [handlePublish, id]);

  const onConvert = useCallback(async () => {
    await handleConvert(id);
  }, [handleConvert, id]);

  const onBack = useCallback(() => {
    router.push('/collected-products');
  }, [router]);

  const onRefresh = useCallback(() => {
    loadProduct(id);
  }, [loadProduct, id]);

  return (
    <EditPageLayout
      state={state}
      dispatch={dispatch}
      id={id}
      onSave={onSave}
      onTranslate={onTranslate}
      onPublish={onPublish}
      onConvert={onConvert}
      onBack={onBack}
      onRefresh={onRefresh}
    />
  );
}
