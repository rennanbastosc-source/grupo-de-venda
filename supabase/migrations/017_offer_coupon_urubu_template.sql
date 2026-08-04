alter table public.offers add column if not exists coupon text;

-- only upgrade known old defaults; never clobber custom templates
update public.app_settings
set message_template = E'🔥 {{caption}}\n\n{{title}}\n\n{{coupon_line}}\npor {{price_line}}\n{{affiliate_url}}',
    updated_at = now()
where id = 1
  and (
    message_template = E'🔥 {{title}}\n💰 {{price}}\n🔗 {{affiliate_url}}'
    or message_template = '{{caption}}\n\n🔗 {{affiliate_url}}'
    or message_template = E'{{caption}}\n\n🔗 {{affiliate_url}}'
  );
