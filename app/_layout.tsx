import {Stack} from 'expo-router';import {StatusBar} from 'expo-status-bar';import {colors} from '../src/theme';import {useGameAudio} from '../src/viewmodels/useGameAudio';
export default function Layout(){useGameAudio();return <><StatusBar style="auto"/><Stack screenOptions={{headerStyle:{backgroundColor:colors.cream},headerTintColor:colors.green,headerTitleStyle:{fontWeight:'800'}}}/></>}
