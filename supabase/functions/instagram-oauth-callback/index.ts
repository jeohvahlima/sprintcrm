import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Instagram tem App ID/Secret separados do Facebook
const INSTAGRAM_APP_ID = Deno.env.get('INSTAGRAM_APP_ID') || '1353481286527361';
const INSTAGRAM_APP_SECRET = Deno.env.get('INSTAGRAM_APP_SECRET') || Deno.env.get('META_APP_SECRET') || '';
const DEFAULT_REDIRECT_URI = 'https://wazecrm.lovable.app/oauth/callback';

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, companyId, redirectUri } = await req.json();

    if (!code || !companyId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing code or companyId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Ensure redirect_uri matches exactly
    const REDIRECT_URI = redirectUri || DEFAULT_REDIRECT_URI;

    console.log('=== Instagram OAuth Callback ===');
    console.log('Company:', companyId);
    console.log('Redirect URI:', REDIRECT_URI);
    console.log('App ID:', INSTAGRAM_APP_ID);
    console.log('App Secret configured:', INSTAGRAM_APP_SECRET.length > 0);
    console.log('Code (first 20 chars):', code.substring(0, 20) + '...');

    // Strip #_ from code if present (Instagram appends this)
    const cleanCode = code.replace(/#_$/, '').trim();

    // ============================================
    // Step 2: Exchange code for short-lived token
    // Using FormData (multipart/form-data) as per Meta docs
    // https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login#step-2---exchange-the-code-for-a-token
    // ============================================
    const tokenUrl = 'https://api.instagram.com/oauth/access_token';
    
    const formData = new FormData();
    formData.append('client_id', INSTAGRAM_APP_ID);
    formData.append('client_secret', INSTAGRAM_APP_SECRET);
    formData.append('grant_type', 'authorization_code');
    formData.append('redirect_uri', REDIRECT_URI);
    formData.append('code', cleanCode);

    console.log('Exchanging code for token via FormData POST...');
    
    const tokenResponse = await fetch(tokenUrl, {
      method: 'POST',
      body: formData,
    });

    const tokenText = await tokenResponse.text();
    console.log('Token response status:', tokenResponse.status);
    console.log('Token response body:', tokenText);

    let tokenData: any;
    try {
      tokenData = JSON.parse(tokenText);
    } catch {
      console.error('Failed to parse token response as JSON');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid response from Instagram: ' + tokenText.substring(0, 200) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for errors
    if (!tokenResponse.ok || tokenData.error_type || tokenData.error) {
      console.error('Token exchange failed:', JSON.stringify(tokenData));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: tokenData.error_message || tokenData.error?.message || 'Failed to exchange code for token' 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse response - new API returns data[] array, old returns flat object
    let shortLivedToken: string;
    let instagramUserId: string;

    if (tokenData.data && Array.isArray(tokenData.data) && tokenData.data.length > 0) {
      // New Instagram Business Login API format
      shortLivedToken = tokenData.data[0].access_token;
      instagramUserId = tokenData.data[0].user_id;
      console.log('Parsed token from data[] array format');
    } else if (tokenData.access_token) {
      // Legacy/flat format
      shortLivedToken = tokenData.access_token;
      instagramUserId = tokenData.user_id;
      console.log('Parsed token from flat format');
    } else {
      console.error('Unexpected token response format:', JSON.stringify(tokenData));
      return new Response(
        JSON.stringify({ success: false, error: 'Unexpected response format from Instagram' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Got short-lived token for user:', instagramUserId);

    // ============================================
    // Step 3: Exchange for long-lived token
    // ============================================
    let accessToken = shortLivedToken;
    let expiresIn = 3600;

    try {
      const longLivedUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortLivedToken}`;
      const longLivedResponse = await fetch(longLivedUrl);
      const longLivedData = await longLivedResponse.json();

      if (longLivedResponse.ok && longLivedData.access_token) {
        accessToken = longLivedData.access_token;
        expiresIn = longLivedData.expires_in || 5184000;
        console.log('Got long-lived token, expires in:', expiresIn);
      } else {
        console.warn('Long-lived token exchange failed, using short-lived:', JSON.stringify(longLivedData));
      }
    } catch (llErr) {
      console.warn('Long-lived token exchange error:', llErr);
    }

    // Get user profile info
    let username = '';
    try {
      const profileUrl = `https://graph.instagram.com/me?fields=id,username&access_token=${accessToken}`;
      const profileResponse = await fetch(profileUrl);
      const profileData = await profileResponse.json();
      username = profileData.username || '';
      console.log('Instagram username:', username);
    } catch (profileErr) {
      console.warn('Profile fetch error:', profileErr);
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Update tenant_integrations
    const { data: existingIntegration } = await supabase
      .from('tenant_integrations')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    const integrationData = {
      instagram_ig_id: instagramUserId,
      instagram_username: username,
      instagram_status: 'connected',
      meta_access_token: accessToken,
      meta_token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString()
    };

    if (existingIntegration) {
      await supabase
        .from('tenant_integrations')
        .update(integrationData)
        .eq('id', existingIntegration.id);
    } else {
      await supabase
        .from('tenant_integrations')
        .insert({ company_id: companyId, ...integrationData });
    }

    // Also update whatsapp_connections for webhook processing
    const { data: existingConn } = await supabase
      .from('whatsapp_connections')
      .select('id')
      .eq('company_id', companyId)
      .maybeSingle();

    const connectionData = {
      instagram_account_id: instagramUserId,
      instagram_access_token: accessToken,
    };

    if (existingConn) {
      await supabase
        .from('whatsapp_connections')
        .update(connectionData)
        .eq('id', existingConn.id);
    } else {
      await supabase
        .from('whatsapp_connections')
        .insert({
          company_id: companyId,
          instance_name: `INSTAGRAM_${companyId.slice(0, 8).toUpperCase()}`,
          api_provider: 'meta',
          status: 'connected',
          ...connectionData
        });
    }

    console.log('Instagram integration saved successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        username,
        userId: instagramUserId 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Instagram OAuth callback error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
