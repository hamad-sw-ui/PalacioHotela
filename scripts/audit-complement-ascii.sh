:
sudo -n -u postgres psql -d palacio -tAc "select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='site_settings' and column_name in ('facebook_url','page_hero_image','gallery_image_2','gallery_image_3','fallback_image','time_zone','city_fr','city_en','country_fr','country_en','tagline_fr','tagline_en','footer_baseline_fr','footer_baseline_en','google_client_id')"

