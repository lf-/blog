#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int main(void) {
    int pid = fork();
    if (pid == -1) {
        perror("fork");
        return 1;
    } else if (pid == 0) {
        execl("./crasher", "./crasher", NULL);
        return 1;
    } else {
        // parent
        int status;
        printf("[caller] spawned pid %d\n", pid);
        int ret = waitpid(pid, &status, 0);
        printf("[caller] waitpid: %d, exited? %d status %d, signaled? %d signal %d\n", ret, WIFEXITED(status), WEXITSTATUS(status), WIFSIGNALED(status), WTERMSIG(status));
        return 0;
    }
}
