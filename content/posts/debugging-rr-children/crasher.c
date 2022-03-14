#include <stdio.h>
#include <stdlib.h>

int main(void) {
    printf("[crasher] about to crash\n");
    abort();
}
