import React, {useState} from 'react';
import {View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList} from 'react-native';


export default function ChatbotScreen(){
const [messages,setMessages] = useState([{id:'1',from:'bot',text:'Hello, how can I help you?'}]);
const [text,setText]=useState('');


function send(){
if(!text) return;
const userMsg = {id:Date.now().toString(),from:'user',text};
setMessages(prev=>[...prev,userMsg]);
setText('');
// Mock bot reply
setTimeout(()=> setMessages(prev=>[...prev,{id:Date.now()+2,to:null,from:'bot',text:'If this is an emergency press SOS or call local authorities.'}]),800);
}


return (
<View style={styles.container}>
<FlatList data={messages} keyExtractor={i=>i.id} renderItem={({item})=> (
<View style={[styles.msg, item.from==='bot'?styles.bot:styles.user]}><Text>{item.text}</Text></View>
)} />


<View style={styles.inputRow}>
<TextInput value={text} onChangeText={setText} placeholder="Ask for help (multilingual)" style={styles.input} />
<TouchableOpacity onPress={send} style={styles.send}><Text style={{color:'#fff'}}>Send</Text></TouchableOpacity>
</View>
</View>
);
}


const styles = StyleSheet.create({container:{flex:1,padding:12},msg:{padding:10,borderRadius:8,marginVertical:6,maxWidth:'80%'},bot:{backgroundColor:'#eee'},user:{backgroundColor:'#cfe9ff',alignSelf:'flex-end'},inputRow:{flexDirection:'row',alignItems:'center'},input:{flex:1,borderWidth:1,borderColor:'#ddd',borderRadius:8,padding:8,marginRight:8},send:{backgroundColor:'#0066cc',padding:10,borderRadius:8}});