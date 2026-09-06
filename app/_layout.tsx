import {Stack} from 'expo-router';import {StatusBar} from 'expo-status-bar';import {colors} from '../src/theme';
export default function Layout(){return <><StatusBar style="auto"/><Stack screenOptions={{headerStyle:{backgroundColor:colors.cream},headerTintColor:colors.green,headerTitleStyle:{fontWeight:'800'}}}/></>}
