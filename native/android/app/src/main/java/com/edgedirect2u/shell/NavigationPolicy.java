package com.edgedirect2u.shell;
import java.net.URI;
import java.util.Set;
public final class NavigationPolicy {
    private static final Set<String> PAYMENTS=Set.of("checkout.paystack.com", "paystack.com");
    private NavigationPolicy() {}
    public static boolean internal(String value) {
        try { URI uri=new URI(value);return "https".equalsIgnoreCase(uri.getScheme())&&"edgedirect2u.com".equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&(uri.getPort()==-1||uri.getPort()==443); } catch(Exception error) { return false; }
    }
    public static boolean external(String value, boolean gesture) {
        try { URI uri=new URI(value);if(uri.getUserInfo()!=null)return false;String scheme=uri.getScheme();if(gesture&&("tel".equals(scheme)||"mailto".equals(scheme)||"geo".equals(scheme)))return true;return "https".equalsIgnoreCase(scheme)&&uri.getHost()!=null&&(gesture||PAYMENTS.contains(uri.getHost().toLowerCase(java.util.Locale.ROOT))); }catch(Exception error){return false;}
    }
    public static boolean appLink(String value,String startPath) {
        if(!internal(value))return false;
        try { String path=new URI(value).getPath();return "/driver".equals(startPath)?("/driver".equals(path)||path.startsWith("/driver/")):"/checkout/confirmation".equals(path); }catch(Exception error){return false;}
    }
}
