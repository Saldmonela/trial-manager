import React from 'react';
import {describe,it,expect,vi} from 'vitest';
import {render,screen,fireEvent,waitFor} from '../../../test/test-utils';
import Modal from '../Modal';
describe('dialog accessibility',()=>{
 it('Escape closes the dialog and title labels it',()=>{const close=vi.fn();render(<Modal isOpen onClose={close} title="Accessible dialog"><input aria-label="Input"/></Modal>);expect(screen.getByRole('dialog')).toHaveAccessibleName('Accessible dialog');fireEvent.keyDown(document,{key:'Escape'});expect(close).toHaveBeenCalledTimes(1);});
 it('Tab wraps inside the modal',async()=>{render(<Modal isOpen onClose={()=>{}} title="Dialog"><input aria-label="Input"/><button>Last</button></Modal>);const last=screen.getByRole('button',{name:'Last'});last.focus();fireEvent.keyDown(document,{key:'Tab'});await waitFor(()=>expect(screen.getByRole('button',{name:'Tutup dialog'})).toHaveFocus());});
});
