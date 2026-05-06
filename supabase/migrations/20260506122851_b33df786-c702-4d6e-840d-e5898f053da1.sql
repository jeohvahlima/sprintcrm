CREATE OR REPLACE FUNCTION public.update_lead_from_ad_conversation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_lead_id UUID;
  v_existing_tags TEXT[];
  v_new_tags TEXT[];
  v_is_ad BOOLEAN;
BEGIN
  v_is_ad := (NEW.ad_source_type = 'ad' OR NEW.ctwa_clid IS NOT NULL);

  -- Only process if it's a real ad conversion. Internal mass-send campaigns must NOT add tags.
  IF NOT v_is_ad THEN
    RETURN NEW;
  END IF;

  IF NEW.lead_id IS NOT NULL THEN
    v_lead_id := NEW.lead_id;
  ELSIF NEW.telefone_formatado IS NOT NULL THEN
    SELECT id INTO v_lead_id
    FROM public.leads
    WHERE company_id = NEW.company_id
      AND (
        regexp_replace(COALESCE(telefone, ''), '[^0-9]', '', 'g') = NEW.telefone_formatado
        OR regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = NEW.telefone_formatado
      )
    LIMIT 1;
  END IF;

  IF v_lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(tags, ARRAY[]::TEXT[]) INTO v_existing_tags
  FROM public.leads WHERE id = v_lead_id;

  v_new_tags := ARRAY['Click-to-WhatsApp'::TEXT, 'Meta Ads'::TEXT];

  IF NEW.campanha_nome IS NOT NULL AND NEW.campanha_nome != '' THEN
    v_new_tags := v_new_tags || NEW.campanha_nome::TEXT;
  END IF;

  UPDATE public.leads
  SET
    tags = (SELECT ARRAY(SELECT DISTINCT unnest FROM unnest(v_existing_tags || v_new_tags))),
    lead_source_type = COALESCE(lead_source_type, 'click_to_whatsapp'),
    utm_source = COALESCE(utm_source, 'facebook'),
    utm_medium = COALESCE(utm_medium, 'click_to_whatsapp'),
    campaign_id = COALESCE(campaign_id, NEW.campanha_id),
    ad_id = COALESCE(ad_id, NEW.ad_source_id),
    conversion_timestamp = COALESCE(conversion_timestamp, NEW.created_at),
    updated_at = NOW()
  WHERE id = v_lead_id;

  IF NEW.lead_id IS NULL THEN
    NEW.lead_id := v_lead_id;
  END IF;

  RETURN NEW;
END;
$$;