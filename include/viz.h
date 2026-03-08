#ifndef VIZ_H
#define VIZ_H

void viz_init(const char *output_path);
void viz_shutdown(void);
void viz_thread_register(const char *thread_name);
const char *viz_current_thread_name(void);
unsigned long viz_current_thread_numeric_id(void);
void viz_point(const char *node_id, const char *file, int line, const char *func);

#define VIZ(node_id) viz_point((node_id), __FILE__, __LINE__, __func__)

#endif
