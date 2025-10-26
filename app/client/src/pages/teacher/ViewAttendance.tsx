import { useState, useEffect } from 'react';
import { 
  Table, 
  Card, 
  Button, 
  DatePicker, 
  Select, 
  Space, 
  Input, 
  Tag, 
  Typography, 
  message,
  Modal,
  Form,
  Row,
  Col,
  Statistic,
  TableProps
} from 'antd';
import { 
  SearchOutlined, 
  FileExcelOutlined, 
  FilterOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs, { Dayjs } from 'dayjs';
import { CSVLink } from 'react-csv';

type AttendanceStatus = 'present' | 'absent' | 'late';

interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  date: string;
  status: AttendanceStatus;
  markedBy: string;
  notes: string;
  sessionId: string;
}

interface ClassInfo {
  id: string;
  name: string;
}

interface Filters {
  dateRange: [Dayjs, Dayjs] | null;
  status: AttendanceStatus | 'all';
  classId: string;
  search: string;
}

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

// Mock data - replace with API calls
const mockAttendance: AttendanceRecord[] = [
  {
    id: '1',
    studentId: 'S001',
    studentName: 'John Doe',
    classId: 'CS101',
    className: 'Introduction to Programming',
    date: '2025-09-10T10:00:00',
    status: 'present',
    markedBy: 'Prof. Smith',
    notes: 'On time',
    sessionId: 'sess_12345'
  },
  {
    id: '2',
    studentId: 'S002',
    studentName: 'Jane Smith',
    classId: 'CS101',
    className: 'Introduction to Programming',
    date: '2025-09-10T10:00:00',
    status: 'absent',
    markedBy: 'Prof. Smith',
    notes: 'No show',
    sessionId: 'sess_12345'
  },
  // Add more mock data as needed
];

const ViewAttendance = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>(mockAttendance);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>(mockAttendance);
  const [filters, setFilters] = useState<Filters>({
    dateRange: null,
    status: 'all',
    classId: 'all',
    search: ''
  } as Filters);
  const [isFilterVisible, setIsFilterVisible] = useState<boolean>(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [isEditModalVisible, setIsEditModalVisible] = useState<boolean>(false);
  const [form] = Form.useForm();

  // Mock classes - replace with API call
  const classes: ClassInfo[] = [
    { id: 'CS101', name: 'CS 101 - Introduction to Programming' },
    { id: 'CS201', name: 'CS 201 - Data Structures' },
    { id: 'CS301', name: 'CS 301 - Algorithms' },
  ];

  // Fetch attendance data (mock implementation)
  const fetchAttendance = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setAttendanceData(mockAttendance);
      setFilteredData(mockAttendance);
    } catch (error) {
      console.error('Error fetching attendance:', error);
      message.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttendance();
  }, []);

  // Apply filters
  const applyFilters = () => {
    let result = [...attendanceData];

    // Filter by date range
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const [startDate, endDate] = filters.dateRange;
      result = result.filter(item => {
        const itemDate = dayjs(item.date);
        return itemDate.isAfter(startDate.startOf('day')) && 
               itemDate.isBefore(endDate.endOf('day'));
      });
    }

    // Filter by status
    if (filters.status !== 'all') {
      result = result.filter(item => item.status === filters.status);
    }

    // Filter by class
    if (filters.classId !== 'all') {
      result = result.filter(item => item.classId === filters.classId);
    }

    // Filter by search term
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      result = result.filter(item => 
        item.studentName.toLowerCase().includes(searchTerm) ||
        item.studentId.toLowerCase().includes(searchTerm) ||
        item.className.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredData(result);
    setIsFilterVisible(false);
  };

  // Reset all filters
  const resetFilters = () => {
    setFilters({
      dateRange: null,
      status: 'all',
      classId: 'all',
      search: ''
    });
    setFilteredData(attendanceData);
    setIsFilterVisible(false);
  };

  // Handle edit attendance
  const handleEdit = (record: AttendanceRecord) => {
    setEditingRecord(record);
    form.setFieldsValue({
      status: record.status,
      notes: record.notes
    });
    setIsEditModalVisible(true);
  };

  // Handle save edited attendance
  const handleSave = async () => {
    if (!editingRecord) return;
    
    try {
      const values = await form.validateFields();
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update the record
      const updatedData = attendanceData.map(item => 
        item.id === editingRecord.id 
          ? { 
              ...item, 
              status: values.status as AttendanceStatus, 
              notes: values.notes as string,
              date: new Date().toISOString() 
            } 
          : item
      );
      
      setAttendanceData(updatedData);
      setFilteredData(updatedData);
      message.success('Attendance updated successfully');
      setIsEditModalVisible(false);
    } catch (error) {
      console.error('Error updating attendance:', error);
    }
  };

  // Calculate attendance statistics
  const getStats = () => {
    const total = filteredData.length;
    const present = filteredData.filter(item => item.status === 'present').length;
    const absent = filteredData.filter(item => item.status === 'absent').length;
    const late = filteredData.filter(item => item.status === 'late').length;
    
    return {
      total: Number(total),
      present: Number(present),
      absent: Number(absent),
      late: Number(late),
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0
    };
  };

  const stats = getStats();

  // Table columns
  const columns: TableProps<AttendanceRecord>['columns'] = [
    {
      title: 'Student',
      dataIndex: 'studentName',
      key: 'studentName',
      render: (text, record) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-gray-500 text-xs">{record.studentId}</div>
        </div>
      ),
      sorter: (a, b) => a.studentName.localeCompare(b.studentName),
    },
    {
      title: 'Class',
      dataIndex: 'className',
      key: 'className',
      render: (text) => <span className="text-gray-700">{text}</span>,
      sorter: (a, b) => a.className.localeCompare(b.className),
    },
    {
      title: 'Date & Time',
      dataIndex: 'date',
      key: 'date',
      render: (date) => dayjs(date).format('MMM D, YYYY h:mm A'),
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: AttendanceStatus) => {
        const statusMap: Record<AttendanceStatus, { color: string; icon: JSX.Element }> = {
          present: { color: 'green', icon: <CheckCircleOutlined /> },
          absent: { color: 'red', icon: <CloseCircleOutlined /> },
          late: { color: 'orange', icon: <ClockCircleOutlined /> },
        };
        
        const statusInfo = statusMap[status as keyof typeof statusMap] || { color: 'gray', icon: <></> };
        
        return (
          <Tag 
            color={statusInfo.color} 
            className="flex items-center gap-1"
          >
            {statusInfo.icon} {status.charAt(0).toUpperCase() + status.slice(1)}
          </Tag>
        );
      },
      filters: [
        { text: 'Present', value: 'present' },
        { text: 'Absent', value: 'absent' },
        { text: 'Late', value: 'late' },
      ],
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Marked By',
      dataIndex: 'markedBy',
      key: 'markedBy',
    },
    {
      title: 'Notes',
      dataIndex: 'notes',
      key: 'notes',
      render: (text) => text || '-',
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Button 
          type="link" 
          onClick={() => handleEdit(record)}
          className="p-0"
        >
          Edit
        </Button>
      ),
    },
  ];

  // CSV data for export
  const csvData = filteredData.map(item => ({
    'Student ID': item.studentId,
    'Student Name': item.studentName,
    'Class ID': item.classId,
    'Class Name': item.className,
    'Date': dayjs(item.date).format('MMM D, YYYY h:mm A'),
    'Status': item.status.charAt(0).toUpperCase() + item.status.slice(1),
    'Marked By': item.markedBy,
    'Notes': item.notes || '',
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <Title level={3} className="mb-0">Attendance Records</Title>
          <Text type="secondary">View and manage student attendance records</Text>
        </div>
        <div className="flex gap-2
">
          <Button 
            icon={<FilterOutlined />} 
            onClick={() => setIsFilterVisible(true)}
          >
            Filter
          </Button>
          <CSVLink 
            data={csvData} 
            filename={`attendance-${new Date().toISOString().split('T')[0]}.csv`}
          >
            <Button type="primary" icon={<FileExcelOutlined />}>
              Export
            </Button>
          </CSVLink>
        </div>
      </div>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} className="mb-6">
        <Col xs={24} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic 
              title="Total Records" 
              value={stats.total} 
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic 
              title="Present" 
              value={stats.present} 
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic 
              title="Absent" 
              value={stats.absent} 
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card className="h-full">
            <Statistic 
              title="Attendance Rate" 
              value={stats.attendanceRate} 
              suffix="%"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Attendance Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          pagination={{ 
            pageSize: 10, 
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} records`
          }}
        />
      </Card>

      {/* Filter Modal */}
      <Modal
        title="Filter Attendance"
        open={isFilterVisible}
        onCancel={() => setIsFilterVisible(false)}
        footer={[
          <Button key="reset" onClick={resetFilters}>
            Reset
          </Button>,
          <Button 
            key="apply" 
            type="primary" 
            onClick={applyFilters}
            icon={<FilterOutlined />}
          >
            Apply Filters
          </Button>,
        ]}
      >
        <Form layout="vertical" className="mt-4">
          <Form.Item label="Date Range">
            <RangePicker 
              className="w-full" 
              onChange={(dates) => setFilters({...filters, dateRange: dates})}
              value={filters.dateRange}
            />
          </Form.Item>
          
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Status">
                <Select
                  value={filters.status}
                  onChange={(value) => setFilters({...filters, status: value})}
                  className="w-full"
                >
                  <Option value="all">All Status</Option>
                  <Option value="present">Present</Option>
                  <Option value="absent">Absent</Option>
                  <Option value="late">Late</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Class">
                <Select
                  value={filters.classId}
                  onChange={(value) => setFilters({...filters, classId: value})}
                  className="w-full"
                >
                  <Option value="all">All Classes</Option>
                  {classes.map(cls => (
                    <Option key={cls.id} value={cls.id}>
                      {cls.name}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item label="Search">
            <Input
              placeholder="Search by name, ID, or class"
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => setFilters({...filters, search: e.target.value})}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit Attendance Modal */}
      <Modal
        title="Edit Attendance Record"
        open={isEditModalVisible}
        onCancel={() => setIsEditModalVisible(false)}
        onOk={handleSave}
        okText="Save Changes"
        confirmLoading={loading}
      >
        {editingRecord && (
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              status: editingRecord.status,
              notes: editingRecord.notes
            }}
          >
            <Form.Item label="Student">
              <Input 
                value={`${editingRecord.studentName} (${editingRecord.studentId})`} 
                disabled 
              />
            </Form.Item>
            
            <Form.Item label="Class">
              <Input 
                value={editingRecord.className} 
                disabled 
              />
            </Form.Item>
            
            <Form.Item label="Date & Time">
              <Input 
                value={dayjs(editingRecord.date).format('MMM D, YYYY h:mm A')} 
                disabled 
              />
            </Form.Item>
            
            <Form.Item 
              name="status" 
              label="Status"
              rules={[{ required: true, message: 'Please select status' }]}
            >
              <Select>
                <Option value="present">Present</Option>
                <Option value="absent">Absent</Option>
                <Option value="late">Late</Option>
              </Select>
            </Form.Item>
            
            <Form.Item 
              name="notes" 
              label="Notes"
            >
              <Input.TextArea rows={3} placeholder="Add any notes here" />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ViewAttendance;
