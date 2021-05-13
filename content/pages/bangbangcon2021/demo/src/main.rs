use crate::things::*;
use libc::*;
use std::{mem, slice, str};
mod things;

use owoify::OwOifiable;
static mut REAL_WRITE: Option<LibcWrite> = None;

unsafe extern "C" fn write_owo(fd: i32, ptr: *const c_void, len: usize) -> isize {
    let s = slice::from_raw_parts(ptr as *const _, len);
    let s = str::from_utf8(s).unwrap();
    let owoified = s.to_string().owoify();

    REAL_WRITE.unwrap()(fd, owoified.as_ptr() as *const _, owoified.len());
    len as isize
}

fn main() {
    let addr = get_hex_from_cmdline();
    let addr = (addr + 0x555555554000) as *mut usize;

    unsafe {
        REAL_WRITE = Some(mem::transmute(*addr));
        mprotect(
            (addr as usize & !(0x1000 - 1)) as *mut _,
            0x1000,
            PROT_READ | PROT_WRITE,
        );
        *addr = write_owo as usize;
    }
    let s = "hello !!con!!\n";
    unsafe { write(1, s.as_ptr() as *const _, s.len()) };

    println!("hello !!con!! from println");
}
