package android.content;
import java.util.HashMap;
import java.util.Map;
public class SharedPreferences {
    public final Map<String,Object> map = new HashMap<String,Object>();
    public interface Editor { Editor putString(String k,String v); Editor putLong(String k,long v); Editor remove(String k); void apply(); }
    public String getString(String k,String d){ Object o=map.get(k); return o==null?d:(String)o; }
    public long getLong(String k,long d){ Object o=map.get(k); return o==null?d:(Long)o; }
    public Editor edit(){ return new Editor(){
        public Editor putString(String k,String v){map.put(k,v);return this;}
        public Editor putLong(String k,long v){map.put(k,v);return this;}
        public Editor remove(String k){map.remove(k);return this;}
        public void apply(){}
    };}
}
