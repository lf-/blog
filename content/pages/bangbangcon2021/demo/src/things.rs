pub type LibcWrite = unsafe extern "C" fn(fd: i32, ptr: *const libc::c_void, len: usize) -> isize;
pub fn get_hex_from_cmdline() -> usize {
    usize::from_str_radix(&std::env::args().skip(1).next().unwrap(), 16).unwrap()
}
